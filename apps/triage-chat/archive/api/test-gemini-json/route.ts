/**
 * Test endpoint for debugging Gemini JSON output
 */

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.GOOGLE_GENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key not configured' },
        { status: 500 }
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.7,
        maxOutputTokens: 2048,
      },
    });

    const prompt = `Analyze this message for medical emergencies and return JSON:

Message: "I am having trouble breathing"

Return a JSON object with this exact structure:
{
  "isEmergency": boolean,
  "emergencyType": string,
  "confidence": number between 0 and 1,
  "reasoning": string
}

You must respond with valid JSON only. No markdown, no explanation.`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    try {
      const parsed = JSON.parse(responseText);
      return NextResponse.json({
        success: true,
        geminiResponse: parsed,
        rawText: responseText,
      });
    } catch (parseError: any) {
      return NextResponse.json({
        success: false,
        error: 'Failed to parse JSON',
        rawText: responseText,
        parseError: parseError?.message || 'Unknown parse error',
      });
    }
  } catch (error: any) {
    console.error('Test Gemini error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Unknown error',
        stack: error?.stack,
      },
      { status: 500 }
    );
  }
}
