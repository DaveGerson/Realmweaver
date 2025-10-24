import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

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

    let contents: string;

    // Per Gemini API guidelines, responseSchema/MimeType cannot be used with tools.
    if (config.tools) {
        delete config.responseMimeType;
        delete config.responseSchema;
        const groundedPrompt = `Based on grounded search results for the character "${prompt}", generate a detailed entity for a fantasy tabletop RPG like Dungeons & Dragons, summarizing their key information from established lore. If the character is not well-known, create a new character inspired by the prompt.`;
        // When using tools, we instruct the model to return JSON via the prompt itself.
        contents = `${contextInstruction}${groundedPrompt}\n\nIMPORTANT: Your entire response must be a single, valid JSON object that conforms to this structure: name, description, traits, exampleQuote, backstory, motivations, secrets, stats. Do not wrap it in markdown.`;
    } else {
        contents = `${instructions}\n\n${contextInstruction}Prompt: "${prompt}"`;
    }

    const response = await ai.models.generateContent({
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
        
    const response = await ai.models.generateContent({
        model: modelName,
        contents: `${contextInstruction}${fullPrompt}`,
    });
    return response.text;
}