import { Client } from 'eris';
import { commands, Context } from '../commands';
import * as events from './events';
import Database from '../Database';

export type TicketBotOptions = {
  keys: {
    discord: string;
    youtube: string;
    lavalink: string;
  };
  guildID: string;
  appealHookID: string;
  channels: {
    support: string[];
    modCommands: string;
    devCategory: string;
    botFeedback: string;
    generalChat: string;
    premiumChat: string;
    botCommands: string[];
    premiumCommands: string;
  };
  roles: {
    mods: string;
    formerMods: string;
    trialMods: string;
    acceptedRules: string;
    modManagers: string;
    directors: string;
  };
  dmNotifications: {
    [id: string]: {
      users: string[];
      dmChannelID: string;
    };
  };
  prefix: string;
  db: Database;
  recipients: string[];
  owners: string[];
  development: boolean;
  music: boolean;
};

export default class TicketBot extends Client {
  public opts: TicketBotOptions;
  public context: Context;

  constructor(opts: TicketBotOptions) {
    super(opts.keys.discord, {
      getAllUsers: !opts.development
    });

    this.opts = opts;
    this.context = {
      commands,
      client: this,
      db: this.opts.db
    };

    this.loadEvents();
  }

  public connect(): Promise<void> {
    return Promise.all([
      super.connect(),
      this.opts.db.bootstrap()
    ]).then(() => {
      for (const command of commands.values()) {
        command.onLoad(this.context);
      }
    });
  }

  public loadEvents(): void {
    for (const event of Object.values(events)) {
      if (event.once) {
        this.once(event.packetName, event.handler.bind(this));
      } else {
        this.on(event.packetName, event.handler.bind(this));
      }
    }
  }
}