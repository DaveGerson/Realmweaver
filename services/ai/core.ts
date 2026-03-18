
import { GoogleGenAI } from "@google/genai";

// Lazy initialization to avoid errors when API key is not set
let ai: GoogleGenAI | null = null;

const getAI = () => {
    if (!ai) {
        const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
        if (!apiKey) {
            throw new Error("Gemini API key is not configured. Please set GEMINI_API_KEY in your .env file or enable Mock Mode.");
        }
        ai = new GoogleGenAI({ apiKey });
    }
    return ai;
};

export const generateWithSchema = async (prompt: string, schema: object, instructions: string, configOverrides: object = {}, modelName: string, campaignContext?: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const config: any = {
        responseMimeType: "application/json",
        responseSchema: schema,
        ...configOverrides,
    };
    
    if (modelName.includes('gemini-2.5-pro')) {
        config.thinkingConfig = { thinkingBudget: 32768 };
    } else if (modelName.includes('gemini-2.5-flash')) {
        config.thinkingConfig = { thinkingBudget: 24576 };
    }
    
    const contextInstruction = campaignContext 
        ? `Reference the following existing campaign information for context and consistency:\n<campaign_context>\n${campaignContext}\n</campaign_context>\n\n`
        : '';

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let contents: any;

    // Per Gemini API guidelines, responseSchema/MimeType cannot be used with tools.
    if (config.tools) {
        delete config.responseMimeType;
        delete config.responseSchema;
        const groundedPrompt = `Use Google Search to ground your response in official lore if applicable.`;
        // When using tools, we instruct the model to return JSON via the prompt itself.
        // We also append the instructions to ensure the model follows the requested format.
        const schemaString = JSON.stringify(schema, null, 2);
        contents = `${instructions}\n\n${contextInstruction}${groundedPrompt}\nPrompt: "${prompt}"\n\nIMPORTANT: Your entire response must be a single, valid JSON object that conforms to this schema:\n${schemaString}\n\nDo not wrap it in markdown blocks like \`\`\`json ... \`\`\`. Just return the raw JSON string.\nEnsure all newlines within string values are escaped as \\n. Do not use literal unescaped newlines in strings.`;
    } else if (config.contents) {
        // Allow passing pre-constructed multimodal content
        contents = config.contents;
        const textPart = contents.parts.find((p: {text: string}) => 'text' in p);
        if (textPart) {
            textPart.text = `${instructions}\n\n${contextInstruction}\n\n${textPart.text}`;
        } else {
             contents.parts.push({ text: `${instructions}\n\n${contextInstruction}` });
        }
        delete config.contents;
    }
    else {
        contents = `${instructions}\n\n${contextInstruction}Prompt: "${prompt}"`;
    }

    const response = await getAI().models.generateContent({
        model: modelName,
        contents: contents,
        config,
    });
    
    const jsonString = response.text.trim();
    try {
        // Handle cases where the model might still wrap the output in markdown
        const cleanedJsonString = jsonString.replace(/^```json\n?/, '').replace(/```\n?$/, '').trim();
        return JSON.parse(cleanedJsonString);
    } catch (e) {
        console.error("Failed to parse JSON response:", jsonString);
        throw new Error("Received an invalid response from the AI model.");
    }
};

export const generateText = async (fullPrompt: string, modelName: string, campaignContext?: string) => {
     const contextInstruction = campaignContext 
        ? `Reference the following existing campaign information for context and consistency:\n<campaign_context>\n${campaignContext}\n</campaign_context>\n\n`
        : '';
        
    const response = await getAI().models.generateContent({
        model: modelName,
        contents: `${contextInstruction}${fullPrompt}`,
    });
    return response.text;
}

export const generateChatCompletion = async (
    history: { role: string; parts: { text: string }[] }[], 
    systemInstruction: string, 
    modelName: string, 
    campaignContext?: string
) => {
    const contextInstruction = campaignContext 
        ? `Use the following existing campaign information for context and consistency:\n<campaign_context>\n${campaignContext}\n</campaign_context>\n\n`
        : '';
    
    // Create a deep copy to avoid mutating the original history array from component state
    const contents = JSON.parse(JSON.stringify(history));

    // Prepend context to the first user message for better contextual awareness
    if (contents.length > 0 && contents[0].role === 'user' && contents[0].parts.length > 0) {
        contents[0].parts[0].text = `${contextInstruction}${contents[0].parts[0].text}`;
    }

    // Gemini requires the conversation to end with a user message (no assistant prefill).
    // Strip any trailing model messages so the API call succeeds.
    while (contents.length > 0 && contents[contents.length - 1].role === 'model') {
        contents.pop();
    }

    // Safety: if stripping left us with nothing, create a minimal user prompt
    if (contents.length === 0) {
        contents.push({ role: 'user', parts: [{ text: `${contextInstruction}Continue.` }] });
    }

    const response = await getAI().models.generateContent({
        model: modelName,
        contents: contents,
        config: {
            systemInstruction: systemInstruction,
        },
    });
    return response.text;
};
