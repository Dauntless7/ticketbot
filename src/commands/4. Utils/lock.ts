import { ICommand, CommandParams, CommandOutput } from '../Command';
import { Restricted } from '../decorators';
import { config } from '../../';
import { TextChannel } from 'eris';
import { codeblock, capitalize } from '../../lib/util';
import { Constants } from 'eris';

type ChannelState = Array<{ id: string; name: string; locked: boolean }>;
const SEND_MESSAGES_PERM_BITFIELD = Constants.Permissions.sendMessages;
const READ_MESSAGES_PERM_BITFIELD = Constants.Permissions.readMessages;
const LOCKABLE_CHANNELS: string[] = [
  ...config.channels.support,
  ...config.channels.botCommands,
  config.channels.botFeedback,
  config.channels.generalChat,
  config.channels.premiumChat,
  config.channels.premiumCommands,
  config.channels.betaCommands,
];

const ROLE_ID_OVERRRIDES: Array<{
  roleID: string;
  channelIDs: string[];
  bitfields?: {
    [k in 'lock' | 'unlock']: {
      allow: number;
      deny: number;
    };
  };
}> = [ {
  roleID: config.roles.spentSomeMoney,
  channelIDs: [
    config.channels.premiumChat,
    config.channels.premiumCommands
  ],
  bitfields: {
    lock: { allow: READ_MESSAGES_PERM_BITFIELD, deny: SEND_MESSAGES_PERM_BITFIELD },
    unlock: { allow: READ_MESSAGES_PERM_BITFIELD, deny: 0 }
  }
} ];

@Restricted({ roleIDs: [ config.roles.directors, config.roles.modManagers ] })
export default class LockCommand implements ICommand {
  name = 'lockutil';
  help = '<list | lock | unlock> [all | ...#channels]';
  aliases = ['lu'];

  public async execute({ client, msg, args }: CommandParams): Promise<CommandOutput> {
    const mode = args.shift();
    switch (mode) {
      case 'list':
        return this.list(client);

      case 'lock':
      case 'unlock':
        return this.edit(mode, { client, msg, args });

      default:
        return codeblock(this.help);
    }
  }

  public async list(client: CommandParams['client']) {
    return {
      title: 'Lock State',
      description: codeblock(
        this.getState(client)
          .map(channel => `${channel.locked ? '- (LOCKED)  ' : '+ (UNLOCKED)'} #${channel.name}`)
          .join('\n'),
        'diff'
      ),
    }
  }

  private getState(client: CommandParams['client']): ChannelState {
    return LOCKABLE_CHANNELS.map(id => ({
      id,
      name: (client.getChannel(id) as TextChannel).name,
      locked: !!((client.getChannel(id) as TextChannel)
        .permissionOverwrites
        .get(this.getOverride(id).roleID)
        .deny & SEND_MESSAGES_PERM_BITFIELD)
    }));
  }

  private getOverride(channelID: string): typeof ROLE_ID_OVERRRIDES[number] {
    const override = ROLE_ID_OVERRRIDES.find(override => override.channelIDs.includes(channelID));
    return override || {
      roleID: config.roles.acceptedRules,
      channelIDs: [],
      bitfields: {
        lock: { allow: 0, deny: SEND_MESSAGES_PERM_BITFIELD },
        unlock: { allow: SEND_MESSAGES_PERM_BITFIELD, deny: 0 }
      }
    };
  }

  private async edit(
    mode: 'lock' | 'unlock',
    { client, msg, args }: Partial<CommandParams>
  ) {
    const channels = args[0] === 'all'
      ? LOCKABLE_CHANNELS
      : msg.channelMentions;

    if (channels.length === 0) {
      return `Please specify which channels you want to ${mode}.\n\`${this.help}\``
    }

    if (channels.some(channel => !LOCKABLE_CHANNELS.includes(channel))) {
      return {
        title: `The following channels aren\'t ${mode}able:`,
        description: channels
          .filter(channel => !LOCKABLE_CHANNELS.includes(channel))
          .map(channel => `- <#${channel}>`)
          .join('\n') + `\n\nPlease try running the command again.\nYou can see a list of ${mode}able channels with \`${config.prefix}lockutil list\`.`
      }
    }

    const prompt = await msg.channel.createMessage({ embed: {
      description: `${capitalize(mode)}ing (${channels.length}) channels...`
    } });

    for (const channelID of channels) {
      const { bitfields, roleID } = this.getOverride(channelID);
      const promises = [];

      promises.push((client.getChannel(channelID) as TextChannel).editPermission(
        roleID,
        bitfields[mode].allow,
        bitfields[mode].deny,
        'role',
        `${capitalize(mode)}ed by ${msg.author.username}`
      ));

      if (mode === 'lock') {
        promises.push(client.createMessage(channelID, {
          embed: {
            color: 0xCA2D36,
            title: '🔒 This channel has been locked.',
            description: `This channel has been locked.\nKeep an eye on <#${config.channels.statusUpdates}>.`
          }
        }));
      }
      await Promise.all(promises)
        .catch(console.error);
    }

    await prompt.edit({ embed: {
      description: `Operation probably successful.\nRun \`${config.prefix}lockutil list\` to confirm.`
    } });
    return null;
  }
}
