import { GoogleGenAI } from "@google/genai";

// Инициализация клиента
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateReply = async (
  contactName: string,
  history: { role: string; parts: { text: string }[] }[],
  lastUserMessage: string
): Promise<string> => {
  try {
    const model = 'gemini-2.5-flash';
    
    // Формируем системную инструкцию
    const systemInstruction = `Ты ролевой персонаж. Твое имя ${contactName}. 
    Ты общаешься в мессенджере (похожем на WhatsApp). 
    Отвечай кратко, естественно, используй сленг, эмодзи, если уместно. 
    Не пиши длинные поэмы. Общайся на русском языке.
    Твоя цель - поддержать непринужденный разговор.`;

    const response = await ai.models.generateContent({
      model: model,
      contents: [
        ...history, 
        { role: 'user', parts: [{ text: lastUserMessage }] }
      ],
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.8, // Добавляем немного креативности
        maxOutputTokens: 150, // Ограничиваем длину ответа для реалистичности чата
        thinkingConfig: { thinkingBudget: 0 }, // Отключаем thinking для быстрых ответов и корректной работы с maxOutputTokens
      }
    });

    return response.text || "👍";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Прости, сейчас не могу ответить, плохая связь.";
  }
};