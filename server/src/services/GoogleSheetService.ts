// GoogleSheetService.ts
// Reads Google Sheet content using access token
import axios from 'axios';
import { IPolishQuestion } from '../types/IPolishQuestion';
import { PolishQuestionMapper } from '../utils/PolishQuestionMapper';


export class GoogleSheetService {
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  async readSheetContent(spreadsheetId: string, range: string, size: number = 10): Promise<IPolishQuestion[]> {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`;
    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    });
    if (!response.data || !response.data.values) {
      throw new Error(`Failed to read sheet: ${response.statusText || 'No data returned'}`);
    }
    // Only return items that have both question and answer
    let questions = PolishQuestionMapper.fromSheetRows(response.data.values)
      .filter(q => q.question && q.answer);
    if (size > 0) {
      questions = questions
        .sort((a, b) => (a.rate ?? 0) - (b.rate ?? 0))
        .slice(0, size);
    }
    return questions;
  }

  async updateCell(spreadsheetId: string, range: string, value: string): Promise<void> {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=RAW`;
    await axios.put(
      url,
      { values: [[value]] },
      {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );
  }
}
