// Voice control page
// This version uses MediaRecorder to send audio to the Google Cloud backend.

"use client";

import { useState, useEffect, useRef } from "react";
import { Mic, Phone, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Header from "@/components/Header";

// --- REMOVED: SpeechRecognition types are no longer needed ---

export default function VoiceAssistantPage() {
  const router = useRouter();
  const { status: authStatus } = useSession();

  // --- RENAMED & ADDED STATE ---
  const [isConversationActive, setIsConversationActive] = useState(false);
  const [status, setStatus] = useState("Press the phone button to start talking"); // Updated text

  // --- REPLACED & ADDED REFS ---
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null); // To play the response
  const isConversationActiveRef = useRef(false); // Track conversation state in ref for callbacks
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Keep ref in sync with state
  useEffect(() => {
    isConversationActiveRef.current = isConversationActive;
  }, [isConversationActive]);

  // Redirect if not authenticated
  useEffect(() => {
    if (authStatus === "unauthenticated") {
      router.push("/");
    }
  }, [authStatus, router]);

  // --- REMOVED: The entire useEffect for SpeechRecognition is gone ---

  // --- NEW: Function to start recording audio with silence detection ---
  const startRecording = async () => {
    // Stop any currently playing audio
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
    }

    try {
      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Setup MediaRecorder
      // We use webm/opus, which matches the backend config
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm; codecs=opus' });
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = []; // Clear old audio chunks

      // Store audio data as it comes in
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      // When recording stops, send the audio to the server
      recorder.onstop = () => {
        // Stop the audio stream tracks
        stream.getTracks().forEach(track => track.stop());
        streamRef.current = null;
        
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm; codecs=opus' });
        sendAudioToServer(audioBlob);
      };

      recorder.start();
      setStatus("Listening...");

      // Set up silence detection
      setupSilenceDetection(stream);

    } catch (err) {
      console.error("Error starting recording:", err);
      alert("Could not start recording. Please ensure microphone access is allowed.");
    }
  };

  // --- NEW: Silence detection using Web Audio API ---
  const setupSilenceDetection = (stream: MediaStream) => {
    const audioContext = new AudioContext();
    const analyser = audioContext.createAnalyser();
    const microphone = audioContext.createMediaStreamSource(stream);
    
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.8;
    microphone.connect(analyser);
    
    audioContextRef.current = audioContext;
    analyserRef.current = analyser;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    let silenceStart = Date.now();
    let speechStart = Date.now();
    const SILENCE_THRESHOLD = 10; // Volume threshold (0-255)
    const SILENCE_DURATION = 1500; // 1.5 seconds of silence
    const MIN_SPEECH_DURATION = 500; // Must speak for at least 0.5 seconds

    const checkAudioLevel = () => {
      if (!mediaRecorderRef.current || mediaRecorderRef.current.state !== 'recording') {
        return;
      }

      analyser.getByteFrequencyData(dataArray);
      
      // Calculate average volume
      const average = dataArray.reduce((sum, value) => sum + value, 0) / bufferLength;

      if (average < SILENCE_THRESHOLD) {
        // Silence detected
        const silenceDuration = Date.now() - silenceStart;
        const speechDuration = silenceStart - speechStart;
        
        // Only auto-stop if we've detected speech first and then silence
        if (silenceDuration > SILENCE_DURATION && speechDuration > MIN_SPEECH_DURATION) {
          console.log('Silence detected after speech, stopping recording');
          stopRecording();
          return;
        }
      } else {
        // Sound detected
        if (Date.now() - silenceStart > 100) {
          // Was silent, now speaking - mark start of speech
          speechStart = Date.now();
        }
        silenceStart = Date.now();
      }

      // Continue checking
      requestAnimationFrame(checkAudioLevel);
    };

    checkAudioLevel();
  };

  // --- NEW: Function to stop recording ---
  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop(); // This will trigger the 'onstop' event
      setStatus("Thinking...");
      
      // Clean up audio context
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      analyserRef.current = null;
    }
  };

  // --- MODIFIED: This function now sends a file and plays audio ---
  const sendAudioToServer = async (audioBlob: Blob) => {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.webm');

    try {
      // --- CHANGED: Point to the voice API endpoint ---
      const response = await fetch('/api/voice', {
        method: 'POST',
        body: formData, // Send FormData, not JSON
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || result.details || "Server error");
      }

      // --- CHANGED: We get audio back ---
      setStatus("Speaking response...");

      // Play the response audio
      const audioData = `data:audio/mp3;base64,${result.audio}`;
      const audio = new Audio(audioData);
      audioPlayerRef.current = audio;

      audio.onended = () => {
        // If conversation is still active, automatically start listening again
        if (isConversationActiveRef.current) {
          setStatus("Listening...");
          setTimeout(() => startRecording(), 500); // Small delay before restarting
        } else {
          setStatus("Press the phone button to start talking");
        }
      };
      
      audio.play();

    } catch (error) {
      console.error("Chat error:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      setStatus(`Error: ${errorMessage}`);
    }
  };

  // --- NEW: Start conversation mode ---
  const startConversation = () => {
    setIsConversationActive(true);
    setStatus("Starting conversation...");
    startRecording();
  };

  // --- NEW: End conversation mode ---
  const endConversation = () => {
    setIsConversationActive(false);
    setStatus("Press the phone button to start talking");
    
    // Stop any recording
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    
    // Stop the audio stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    // Clean up audio context
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    
    // Clear any silence timeout
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }
    
    // Stop any playing audio
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current = null;
    }
  };

  return (
    <div className="flex flex-col">
      <Header />

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center pt-12 px-8">
        <h1 className="text-4xl font-semibold mb-2 text-center text-gray-900">
          Voice Assistant
        </h1>
        <p className="text-center text-pink-400 mb-16">
          {status}
        </p>

        {/* Voice Animation Circle */}
        <div className="relative mb-16">
          {/* Always show the animated circle */}
          <div className="relative w-64 h-64 rounded-full flex items-center justify-center transition-all duration-300 shadow-md overflow-hidden">
            {/* Pulsing pink gradient when conversation is active */}
            {isConversationActive ? (
              <div className="absolute inset-0 rounded-full bg-linear-to-r from-pink-200 via-pink-400 to-pink-500 animate-gradient-wave" />
            ) : (
              <div className="absolute inset-0 rounded-full bg-linear-to-br from-white/40 to-white/60 border border-gray-200" />
            )}
            
            <Mic className={`w-20 h-20 ${isConversationActive ? "text-white" : "text-gray-400"} transition-colors z-10 relative`} />
          </div>
        </div>

        <style jsx>{`
          @keyframes gradient-wave {
            0%, 100% {
              transform: scale(1);
              opacity: 1;
            }
            50% {
              transform: scale(1.05);
              opacity: 0.8;
            }
          }
          .animate-gradient-wave {
            animation: gradient-wave 2s ease-in-out infinite;
          }
        `}</style>

        {/* Action Button - Phone to start, X to end */}
        {!isConversationActive ? (
          // Start Conversation Button
          <button
            onClick={startConversation}
            className="w-12 h-12 bg-pink-500 hover:bg-pink-600 rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transition-all"
          >
            <Phone className="w-6 h-6 text-white" />
          </button>
        ) : (
          // End Conversation Button
          <button
            onClick={endConversation}
            className="w-12 h-12 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transition-all"
          >
            <X className="w-6 h-6 text-white" />
          </button>
        )}
      </main>
    </div>
  );
}
