declare module 'lunar-javascript' {
  export const Solar: {
    fromYmdHms(y: number, m: number, d: number, h: number, mi: number, s: number): any;
    fromYmd(y: number, m: number, d: number): any;
    fromDate(date: Date): any;
  };
}
