import 'dotenv/config';
import { DataSource } from 'typeorm';
import { createTypeOrmDataSourceOptions } from './database.config';

export default new DataSource(createTypeOrmDataSourceOptions());
