declare module '@astrajs/collections' {
  export function createClient(options: {
    astraDatabaseId: string;
    astraDatabaseRegion: string;
    applicationToken: string;
  }): any;
}

declare module '@astrajs/rest' {
  export function createClient(options: {
    astraDatabaseId: string;
    astraDatabaseRegion: string;
    applicationToken: string;
  }): any;
}