import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { quotaTracker } from '../middleware/rateLimiter.ts';

interface ChatContextPayload {
  locationName?: string;
  aqi?: number;
  dominantPollutant?: string;
  pm25?: number | null;
  temperatureC?: number;
  humidityPct?: number;
  windSpeedKmh?: number;
  carbonTonnesPerYear?: number;
}

interface ChatHistoryTurn {
  role: 'user' | 'assistant';
  content: string;
}

export async function generateEnvironmentalReply(params: {
  message: string;
  history?: ChatHistoryTurn[];
  context?: ChatContextPayload;
}): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    const err = new Error(
      'Gemini API key is not configured. Please add GEMINI_API_KEY in Settings > Secrets.',
    );
    (err as Error & { statusCode?: number }).statusCode = 503;
    throw err;
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  const ctx = params.context ?? {};
  const contextSummary = ctx.locationName
    ? `Live telemetry context — Location: ${ctx.locationName}, Current US AQI: ${ctx.aqi ?? 'N/A'}, Dominant pollutant: ${ctx.dominantPollutant ?? 'PM2.5'}, PM2.5: ${ctx.pm25 ?? 'N/A'} µg/m³, Temperature: ${ctx.temperatureC ?? 'N/A'}°C, Humidity: ${ctx.humidityPct ?? 'N/A'}%, Wind: ${ctx.windSpeedKmh ?? 'N/A'} km/h${ctx.carbonTonnesPerYear ? `, User Carbon Footprint: ${ctx.carbonTonnesPerYear} tCO2e/yr` : ''}.`
    : 'No active city telemetry selected.';

  const systemInstruction = [
    'You are the VayuMitra Environmental & Air Quality Assistant.',
    'Provide clear, scientifically accurate, actionable guidance on urban air pollution, respiratory protection, meteorology, carbon reduction, and climate science.',
    'Keep responses concise (under 180 words unless detailed steps are requested), structured in plain readable text or short bullet points, and grounded in the provided live atmospheric readings when relevant.',
    'If medical emergencies are described, advise seeking professional medical care promptly.',
    contextSummary,
  ].join(' ');

  const conversationLines = (params.history ?? [])
    .slice(-6)
    .map((turn) => `${turn.role === 'user' ? 'User' : 'Assistant'}: ${turn.content}`)
    .join('\n');

  const prompt = conversationLines
    ? `${conversationLines}\nUser: ${params.message}`
    : params.message;

  quotaTracker.recordUpstream('gemini');

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: prompt,
    config: {
      systemInstruction,
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
    },
  });

  const replyText = response.text?.trim();
  if (!replyText) {
    throw new Error('Received an empty response from the assistant.');
  }
  return replyText;
}
