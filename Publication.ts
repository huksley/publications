export interface Publication {
  _id: string;
  title: string;
  rank: number;
  authors: string[];
  date: Date;
  text: string;
}
