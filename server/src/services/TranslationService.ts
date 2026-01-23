import { GoogleSheetService } from "./GoogleSheetService";
import { AIService } from "./AIService";
import pLimit from 'p-limit';

export class TranslationService {
  private readonly sheetService: GoogleSheetService;
  private readonly aiService: AIService;

  constructor(sheetService: GoogleSheetService, aiService: AIService) {
    this.sheetService = sheetService;
    this.aiService = aiService;
  }

  translateSheetQuestions = async (spreadsheetId: string, range: string): Promise<void> => {
    const questions = await this.sheetService.readSheetContent(spreadsheetId, range);
    const limit = pLimit(5);
    await Promise.all(
      questions
        .filter(q => q.question && q.question.trim() !== "")
        .map(q =>
          limit(async () => {
            try {
              q.answer = await this.aiService.sendPrompt(q.question);
            } catch (err) {
              q.answer = "Translation error: " + (err instanceof Error ? err.message : String(err));
            }
            // Write answer to column D (4th column)
            // Use IPolishQuestion.id as the row number
            const rowNumber = q.id;
            const dRange = `J${rowNumber}`;
            await this.sheetService.updateCell(spreadsheetId, dRange, q.answer);
          })
        )
    );
  };
}
