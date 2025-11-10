import { NextRequest, NextResponse } from 'next/server';
import twilio, { Twilio } from 'twilio';

interface SmsRequestBody {
  to: string;
  message: string;
}

export async function POST(req: NextRequest) {
  try {
    const body: SmsRequestBody = await req.json();

    if (!body.to || !body.message) {
      return NextResponse.json(
        { success: false, error: 'Missing "to" or "message" field' },
        { status: 400 }
      );
    }

    const client: Twilio = twilio(
      process.env.TWILIO_ACCOUNT_SID!,
      process.env.TWILIO_AUTH_TOKEN!
    );

    const msg = await client.messages.create({
      body: body.message,
      from: process.env.TWILIO_PHONE_NUMBER!,
      to: body.to,
    });

    return NextResponse.json({ success: true, sid: msg.sid });
  } catch (error: unknown) {
    console.error('Twilio Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
