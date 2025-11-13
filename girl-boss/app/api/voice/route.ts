import { NextRequest, NextResponse } from 'next/server';
import { SpeechClient } from '@google-cloud/speech';
import { TextToSpeechClient } from '@google-cloud/text-to-speech';
// --- ADDED ---
import { GoogleGenerativeAI } from '@google/generative-ai';

// Helper to get Google credentials from environment
function getGoogleCredentials() {
  const serviceAccountBase64 = process.env.GCP_SERVICE_ACCOUNT_BASE64;
  if (!serviceAccountBase64) {
    throw new Error('GCP_SERVICE_ACCOUNT_BASE64 env variable not set');
  }
  const decodedKey = Buffer.from(serviceAccountBase64, 'base64').toString('utf-8');
  return JSON.parse(decodedKey);
}

// Instantiate clients outside the handler for reuse
const speechClient = new SpeechClient({ credentials: getGoogleCredentials() });
const ttsClient = new TextToSpeechClient({ credentials: getGoogleCredentials() });

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const audioFile = formData.get('audio') as File;

    if (!audioFile) {
      return NextResponse.json({ error: 'Audio file is required' }, { status: 400 });
    }

    // --- 1. SPEECH-TO-TEXT (STT) ---
    console.log('🗣️ [GCloud] Transcribing audio...');
    const audioBytes = Buffer.from(await audioFile.arrayBuffer()).toString('base64');

    const sttRequest = {
      audio: { content: audioBytes },
      config: {
        encoding: 'WEBM_OPUS', // From MediaRecorder
        sampleRateHertz: 48000,  // From MediaRecorder
        languageCode: 'en-US',
      },
    } as const; // <-- THE FIX IS HERE

    const [sttResponse] = await speechClient.recognize(sttRequest);
    const userTranscript = sttResponse.results
      ?.map(result => result.alternatives?.[0].transcript)
      .join('\n') || '';

    if (!userTranscript) {
      console.log('No transcript found.');
      const audioResponse = await textToSpeech("I'm sorry, I didn't quite hear that. Could you say that again?");
      return NextResponse.json({ audio: audioResponse }); // Send audio back
    }

    console.log(`💬 User said: ${userTranscript}`);

    // --- 2. GEMINI (COMPANION LOGIC) ---
    console.log('🧠 Getting Companion response...');
    let aiTextResponse = '';
    const geminiApiKey = process.env.GEMINI_API_KEY;

    if (!geminiApiKey) {
      console.error('GEMINI_API_KEY not configured');
      aiTextResponse = "I'm sorry, I can't connect right now. My system is missing its configuration.";
    } else {
      try {
        const genAI = new GoogleGenerativeAI(geminiApiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
        
        const systemPrompt = `You are a friendly, empathetic, and supportive companion AI for the GirlBoss app. 

Your goal is to be a good friend and an active listener. The user might be feeling unsafe, lonely, anxious, or just want to talk to someone.

Your Role:
- Be extremely supportive, kind, and non-judgmental.
- Use a natural, conversational, and caring tone.
- Ask gentle follow-up questions to keep the conversation going.
- Help the user process their feelings by validating them.
- If the user seems lonely or scared, stay with them in conversation.

IMPORTANT RULES:
- DO NOT give safety advice, directions, or list safe spaces. Your only job is to talk and listen.
- DO NOT act like a robot. Be human-like.
- Keep responses conversational.
- Use plain text only - NO markdown formatting (no bold **, italic *, headers #, etc.).`;

        const currentTime = new Date().toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
        });
        const contextInfo = `
Current Context:
- The user is talking to you via voice.
- The current time is ${currentTime}.
`;
        const fullPrompt = `${systemPrompt}\n\n${contextInfo}\n\nUser: ${userTranscript}\n\nAssistant:`;

        const result = await model.generateContent(fullPrompt);
        aiTextResponse = result.response.text();
        
      } catch (error) {
        console.error('Gemini error (Companion):', error);
        aiTextResponse = "I'm sorry, I'm having trouble connecting right now. I'm still here, though. Just try again in a moment.";
      }
    }
    // --- End of inlined Gemini logic ---
    
    console.log(`🤖 AI said: ${aiTextResponse}`);

    // --- 3. TEXT-TO-SPEECH (TTS) ---
    console.log('🔊 [GCloud] Synthesizing speech...');
    const audioResponse = await textToSpeech(aiTextResponse);

    // Send the Base64 audio string back to the client
    return NextResponse.json({ audio: audioResponse, transcript: userTranscript });

  } catch (error) {
    console.error('❌ Voice agent error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Voice agent failed', details: errorMessage }, { status: 500 });
  }
}

/**
 * Helper function to convert text to speech audio
 * @param text The text to synthesize
 * @returns Base64 encoded MP3 audio string
 */
async function textToSpeech(text: string): Promise<string> {
  const ttsRequest = {
    input: { text: text },
    // This is a high-quality, friendly-sounding voice.
    voice: { languageCode: 'en-US', name: 'en-US-Standard-C' },
    audioConfig: { audioEncoding: 'MP3' as const },
  };

  const [ttsResponse] = await ttsClient.synthesizeSpeech(ttsRequest);
  return (ttsResponse.audioContent as string | Buffer).toString('base64');
}