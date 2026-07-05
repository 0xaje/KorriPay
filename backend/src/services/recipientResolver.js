import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Base abstract class for Recipient Resolvers.
 */
export class BaseResolver {
  constructor(name) {
    this.name = name;
  }

  /**
   * Checks if this resolver supports the given query.
   * @param {string} query
   * @returns {boolean}
   */
  supports(query) {
    throw new Error("Method 'supports()' must be implemented.");
  }

  /**
   * Resolves the query to a recipient format.
   * @param {string} query
   * @returns {Promise<{ resolved: boolean, type: string, address: string, name: string }>}
   */
  async resolve(query) {
    throw new Error("Method 'resolve()' must be implemented.");
  }
}

/**
 * Resolver for L2/EVM Wallet Addresses.
 */
export class WalletAddressResolver extends BaseResolver {
  constructor() {
    super('WalletAddressResolver');
  }

  supports(query) {
    return /^0x[a-fA-F0-9]{40}$/.test(query);
  }

  async resolve(query) {
    // Look up in database
    const user = await prisma.user.findFirst({
      where: {
        walletAddress: { equals: query, mode: 'insensitive' }
      }
    });

    if (user) {
      return {
        resolved: true,
        type: 'wallet',
        address: user.walletAddress,
        name: user.name
      };
    }

    // Return friendly name wrapper for external wallet
    const shortAddress = query.slice(0, 6) + '...' + query.slice(-4);
    return {
      resolved: true,
      type: 'wallet',
      address: query,
      name: `External Wallet (${shortAddress})`
    };
  }
}

/**
 * Resolver for Usernames (@username or plain usernames).
 */
export class UsernameResolver extends BaseResolver {
  constructor() {
    super('UsernameResolver');
  }

  supports(query) {
    // Start with '@', or standard alphanumeric username (excluding wallet addresses or .up.id suffixes)
    return query.startsWith('@') || (/^[a-zA-Z0-9_-]+$/.test(query) && !query.startsWith('0x') && !query.toLowerCase().endsWith('.up.id'));
  }

  async resolve(query) {
    const cleanUsername = query.startsWith('@') ? query.slice(1) : query;

    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { name: { startsWith: cleanUsername, mode: 'insensitive' } },
          { email: { startsWith: cleanUsername, mode: 'insensitive' } }
        ]
      }
    });

    if (!user) {
      user = await prisma.user.findFirst({
        where: {
          OR: [
            { name: { contains: cleanUsername, mode: 'insensitive' } },
            { email: { contains: cleanUsername, mode: 'insensitive' } }
          ]
        }
      });
    }

    if (user && user.walletAddress) {
      return {
        resolved: true,
        type: 'username',
        address: user.walletAddress,
        name: user.name
      };
    }

    return {
      resolved: false,
      type: 'username',
      address: '',
      name: `Unresolved: ${query}`
    };
  }
}

/**
 * Resolver Adapter for future up.id names.
 */
export class UpIdResolver extends BaseResolver {
  constructor() {
    super('UpIdResolver');
  }

  supports(query) {
    return query.toLowerCase().endsWith('.up.id');
  }

  async resolve(query) {
    const namePart = query.slice(0, -6); // Extract name part before '.up.id'

    // Mock deterministic address generation for up.id mock integration
    let hash = 0;
    for (let i = 0; i < namePart.length; i++) {
      hash = namePart.charCodeAt(i) + ((hash << 5) - hash);
    }
    let hex = Math.abs(hash).toString(16).padEnd(40, 'c');
    const mockAddress = '0x' + hex.slice(0, 40);

    const friendlyName = `${namePart.charAt(0).toUpperCase() + namePart.slice(1)} (up.id)`;

    return {
      resolved: true,
      type: 'upid',
      address: mockAddress,
      name: friendlyName
    };
  }
}

/**
 * Service orchestrating resolver adapters without hardcoding provider logic.
 */
export class RecipientResolverService {
  constructor() {
    this.resolvers = [];
  }

  registerResolver(resolver) {
    this.resolvers.push(resolver);
  }

  async resolveRecipient(query) {
    const cleanQuery = (query || '').trim();
    if (!cleanQuery) {
      return { resolved: false, type: 'unknown', address: '', name: 'Empty query' };
    }

    for (const resolver of this.resolvers) {
      if (resolver.supports(cleanQuery)) {
        try {
          const result = await resolver.resolve(cleanQuery);
          if (result.resolved) {
            return result;
          }
        } catch (err) {
          console.error(`[RecipientResolver] ${resolver.name} error:`, err);
        }
      }
    }

    return { resolved: false, type: 'unknown', address: '', name: cleanQuery };
  }
}

// Pre-register current and future adapters
const serviceInstance = new RecipientResolverService();
serviceInstance.registerResolver(new WalletAddressResolver());
serviceInstance.registerResolver(new UsernameResolver());
serviceInstance.registerResolver(new UpIdResolver());

export const recipientResolver = serviceInstance;
