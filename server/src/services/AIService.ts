import { ChatOpenAI } from "@langchain/openai";
import { initChatModel, HumanMessage, SystemMessage } from "langchain";

import * as dotenv from "dotenv";

dotenv.config();

export class AIService {
  private readonly model: ChatOpenAI;

  constructor(modelName: string = "gpt-5-nano", temperature: number = 1) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is not set in the environment variables.");
    }
    this.model = new ChatOpenAI({
      model: modelName,
      apiKey: apiKey,
      temperature: temperature,
    });
  }

  async sendPrompt(prompt: string): Promise<string> {
    // const messages = await this.promptTemplate.formatMessages({ text: prompt });
    // const response = await this.model.invoke(messages);
    const systemMsg = new SystemMessage("Translate  from Polish to Russian. Response should include the translation only");
    const humanMsg = new HumanMessage(prompt);


    const messages = [systemMsg, humanMsg];
    const response = await this.model.invoke(messages);
    console.log(response.content);
    //return response.content;

    return response.content.toString()
  }


}
