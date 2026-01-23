import { IPolishQuestion } from '../types/IPolishQuestion';

export class PolishQuestionMapper {
  static readonly RATE_COLUMN_INDEX = 4;
  private static parseRate(value: unknown): number {
    if (typeof value === 'string' && value.trim() !== '' && !isNaN(Number(value))) {
      return Number(value);
    }
    return 0;
  }

  static fromSheetRows(rows: string[][]): IPolishQuestion[] {
    return rows.map((row: string[], idx: number) => ({
      id: idx + 1,
      question: row[7] ?? '', // J column (index 9)
      answer: row[0] ?? '',   // C column (index 2)
      rate: PolishQuestionMapper.parseRate(row[PolishQuestionMapper.RATE_COLUMN_INDEX]),
    }));
  }
}
