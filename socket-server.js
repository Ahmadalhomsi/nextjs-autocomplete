const { WebSocketServer } = require("ws");
const { Pool } = require("pg");

const PORT = 8080;
const wss = new WebSocketServer({ port: PORT });

// PostgreSQL connection configuration
const pool = new Pool({
    user: "postgres",
    host: "localhost",
    database: "autocomplete",
    password: "ahmad",
    port: 5432,
});

// Initialize database
async function initializeDatabase() {
    const client = await pool.connect();
    try {
        // Enable pg_trgm extension if not enabled
        // await client.query("CREATE EXTENSION IF NOT EXISTS pg_trgm;");

        // Create words table if it doesn't exist
        // await client.query(`
        //   CREATE TABLE IF NOT EXISTS turkish_words (
        //     id SERIAL PRIMARY KEY,
        //     word TEXT UNIQUE NOT NULL
        //   );
        // `);

        // Create trigram index
        await client.query(`
      CREATE INDEX IF NOT EXISTS words_trgm_idx ON turkish_words 
      USING gin (word gin_trgm_ops);
    `);

        // // Check if we need to populate the table
        // const wordCount = await client.query("SELECT COUNT(*) FROM turkish_words;");
        // if (wordCount.rows[0].count === '0') {
        //   // You would typically load this from a comprehensive Turkish word list file
        //   const sampleWords = [
        //     "merhaba", "nasılsın", "günaydın", "teşekkürler", "görüşürüz",
        //     "lütfen", "evet", "hayır", "hoşgeldiniz", "iyi akşamlar"
        //   ];

        //   // Insert sample words
        //   await client.query(`
        //     INSERT INTO turkish_words (word) 
        //     VALUES ${sampleWords.map(word => `('${word}')`).join(',')}
        //     ON CONFLICT (word) DO NOTHING;
        //   `);
        // }
    } catch (err) {
        console.error("Database initialization error:", err);
    } finally {
        client.release();
    }
}

// Get suggestions using pg_trgm
async function getSuggestions(query) {
    if (!query || query.trim() === "") {
        return [];
    }
    try {
        const result = await pool.query(`
        SELECT word, 
               similarity(word, $1) as sim,
               CASE WHEN word ILIKE $2 THEN 1 ELSE 0 END as prefix_match
        FROM turkish_words
        WHERE word % $1 OR word ILIKE $2
        ORDER BY prefix_match DESC, sim DESC
        LIMIT 5;
      `, [query, `${query}%`]);
        return result.rows.map(row => row.word);
    } catch (err) {
        console.error("Error getting suggestions:", err);
        return [];
    }
}

// Initialize WebSocket server
wss.on("connection", (socket) => {
    console.log("New client connected");

    socket.on("message", async (data) => {
        try {
            const parsedData = JSON.parse(data.toString());
            console.log("Received query:", parsedData);

            // Get suggestions from PostgreSQL
            const suggestions = await getSuggestions(parsedData.query);

            // Send suggestions back to client
            socket.send(JSON.stringify({
                type: 'suggestions',
                suggestions,
                query: parsedData.query // Send back original query for context
            }));
        } catch (error) {
            console.error("Error processing message:", error);
            socket.send(JSON.stringify({
                type: 'error',
                message: "Failed to process request"
            }));
        }
    });

    socket.on("close", () => {
        console.log("Client disconnected");
    });
});

// Initialize database before starting server
initializeDatabase()
    .then(() => {
        console.log(`WebSocket server running on ws://localhost:${PORT}`);
    })
    .catch(err => {
        console.error("Failed to initialize database:", err);
        process.exit(1);
    });