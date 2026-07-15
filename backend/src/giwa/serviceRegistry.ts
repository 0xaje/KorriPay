import { BaseServiceProvider, RPCServiceProvider, GIWAServiceRegistry } from '../infrastructure/giwa/GiwaInfrastructure.js';
import { giwa } from '../infrastructure/giwa/index.js';

export { BaseServiceProvider, RPCServiceProvider, GIWAServiceRegistry };
export const serviceRegistry = (giwa as any).registry;

