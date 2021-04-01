const greenlock = require('./lib/greenlock');

async function main() {
    greenlock.sites.add({
        subject: "example.com",
        altnames: ["example.com", "www.example.com"]
    });
}

main();
