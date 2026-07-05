import { GiwaInfrastructure, EnvironmentGiwaConfigProvider } from './GiwaInfrastructure.js';

export const giwa = new GiwaInfrastructure(new EnvironmentGiwaConfigProvider());
export { GiwaInfrastructure, EnvironmentGiwaConfigProvider };
