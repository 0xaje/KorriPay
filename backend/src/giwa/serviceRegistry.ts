import { BaseServiceProvider, RPCServiceProvider, GIWAServiceRegistry } from '../infrastructure/giwa/GiwaInfrastructure.ts';
import { giwa } from '../infrastructure/giwa/index.js';

export { BaseServiceProvider, RPCServiceProvider, GIWAServiceRegistry };
export const serviceRegistry = giwa.registry;

