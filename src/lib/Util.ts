export class Util {
  static getDateInTimeZone(dateStr: string, timeZone: number): Date {
    const serverTimeZone = new Date().getTimezoneOffset();
    const timeZoneDiff = serverTimeZone - timeZone;
    return new Date(new Date(dateStr).getTime() - timeZoneDiff * 60000);
  }

  static uncapitalize(str: string): string {
    return str.charAt(0).toLowerCase() + str.slice(1);
  }

  static capitalize = <T extends string>(s: T) =>
    (s[0].toUpperCase() + s.slice(1)) as Capitalize<typeof s>;
}
