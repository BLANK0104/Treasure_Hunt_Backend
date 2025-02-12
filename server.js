import express from 'express';

const app = express();
const port = 5001;

app.get('/', (_, res) => {
    res.send('Hello World!');
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});