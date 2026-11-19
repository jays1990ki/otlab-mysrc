import 'dotenv/config';
import { createApp } from './src/app.js';
const app = createApp();
const port = process.env.PORT || 3000;
app.listen(port, () => console.log('OT/ICS Basic Lab v1.1.0 started'));
