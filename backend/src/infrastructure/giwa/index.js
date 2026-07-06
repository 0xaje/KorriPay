import { GiwaInfrastructure, EnvironmentGiwaConfigProvider, NetworkRegistry } from './GiwaInfrastructure.js';

export const giwa = new GiwaInfrastructure(new EnvironmentGiwaConfigProvider());
export const networkRegistry = new NetworkRegistry(giwa);
export { GiwaInfrastructure, EnvironmentGiwaConfigProvider, NetworkRegistry };
