export {};

/** 仅声明本扩展用到的 Spicetify 全局成员（够用即可，不求完整）。 */
declare global {
  interface SpicetifyPlayerEvent {
    data?: unknown;
  }

  interface SpicetifyGlobal {
    Player: {
      data: any;
      getProgress(): number;
      getDuration(): number;
      isPlaying(): boolean;
      seek(ms: number): void;
      togglePlay(): void;
      addEventListener(type: string, cb: (e: SpicetifyPlayerEvent) => void): void;
      removeEventListener(type: string, cb: (e: SpicetifyPlayerEvent) => void): void;
    };
    Platform?: any;
    CosmosAsync?: { get(url: string, body?: unknown): Promise<any> };
    Topbar?: {
      Button: new (
        label: string,
        icon: string,
        onClick: (self: unknown) => void,
        disabled?: boolean,
        isActive?: boolean,
      ) => unknown;
    };
    Mousetrap?: { bind(keys: string, cb: () => void): void };
  }

  // eslint-disable-next-line no-var
  var Spicetify: SpicetifyGlobal;

  interface Window {
    Spicetify: SpicetifyGlobal;
    aiLyrics?: { show(): void; hide(): void; toggle(): void };
  }
}
