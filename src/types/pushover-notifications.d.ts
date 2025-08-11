declare module 'pushover-notifications' {
  interface PushoverMessage {
    message: string
    title?: string
    sound?: string
    priority?: number
    url?: string
    url_title?: string
  }

  interface PushoverOptions {
    user: string
    token: string
  }

  class Pushover {
    constructor(options: PushoverOptions)
    send(message: PushoverMessage, callback?: (err: any, result: any) => void): void
  }

  export = Pushover
}