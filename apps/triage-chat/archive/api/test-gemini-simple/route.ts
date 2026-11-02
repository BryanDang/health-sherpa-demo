/**
 * Simple test endpoint for Gemini API
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
    });

    const prompt =
      'Is "I am having trouble breathing" a medical emergency? Answer yes or no.';

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    return NextResponse.json({
      success: true,
      response: responseText,
    });
  } catch (error: any) {
    console.error('Test Gemini simple error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Unknown error',
        errorType: error?.constructor?.name,
        apiKeyLength: process.env.GOOGLE_GENAI_API_KEY?.length,
      },
      { status: 500 }
    );
  }
}
