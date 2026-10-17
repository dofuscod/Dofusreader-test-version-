import Dexie, { Table } from 'dexie';

export interface Book {
  id?: number;
  title: string;
  createdAt: number;
}

export interface Chapter {
  id?: number;
  bookId: number;
  order: number;
  title: string;
  htmlContent: string;
}

class DofusReaderDB extends Dexie {
  books!: Table<Book, number>;
  chapters!: Table<Chapter, number>;

  constructor() {
    super('DofusReaderDB');
    this.version(1).stores({
      books: '++id, title, createdAt',
      chapters: '++id, bookId, order'
    });
  }
}

export const db = new DofusReaderDB();
