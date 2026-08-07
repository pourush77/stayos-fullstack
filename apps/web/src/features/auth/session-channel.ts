export type StayOsSessionEvent =
  | {
      type: 'activity';
      timestamp: number;
      sourceId: string;
    }
  | {
      type: 'tokens-refreshed';
      timestamp: number;
      sourceId: string;
      accessToken: string;
      refreshToken?: string;
      persistent: boolean;
    }
  | {
      type: 'locked';
      timestamp: number;
      sourceId: string;
    }
  | {
      type: 'unlocked';
      timestamp: number;
      sourceId: string;
      accessToken?: string;
      refreshToken?: string;
      persistent?: boolean;
    }
  | {
      type: 'logout';
      timestamp: number;
      sourceId: string;
    };

const CHANNEL_NAME = 'stayos.session';
const STORAGE_EVENT_KEY = 'stayos.session.event';

export function createSessionSourceId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function publishSessionEvent(event: StayOsSessionEvent) {
  if (typeof window === 'undefined') {
    return;
  }

  if ('BroadcastChannel' in window) {
    const channel = new BroadcastChannel(CHANNEL_NAME);

    try {
      channel.postMessage(event);
    } finally {
      channel.close();
    }
  }

  try {
    window.localStorage.setItem(STORAGE_EVENT_KEY, JSON.stringify(event));
    window.localStorage.removeItem(STORAGE_EVENT_KEY);
  } catch {
    // Storage may be unavailable in private browsing or restricted contexts.
  }
}

export function subscribeToSessionEvents(listener: (event: StayOsSessionEvent) => void) {
  if (typeof window === 'undefined') {
    return () => undefined;
  }

  const channel = 'BroadcastChannel' in window ? new BroadcastChannel(CHANNEL_NAME) : undefined;

  const handleChannelMessage = (message: MessageEvent<StayOsSessionEvent>) => {
    listener(message.data);
  };

  const handleStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_EVENT_KEY || !event.newValue) {
      return;
    }

    try {
      listener(JSON.parse(event.newValue) as StayOsSessionEvent);
    } catch {
      // Ignore malformed cross-tab messages.
    }
  };

  channel?.addEventListener('message', handleChannelMessage);
  window.addEventListener('storage', handleStorage);

  return () => {
    channel?.removeEventListener('message', handleChannelMessage);
    channel?.close();
    window.removeEventListener('storage', handleStorage);
  };
}
