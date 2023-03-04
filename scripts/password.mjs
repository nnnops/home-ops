#!/usr/bin/env zx

const password = (await question("What is the password?\n")).trim();

console.log(`password is: '${password}'`);

// -h, --help              help for argon2
// -i, --iterations int    number of iterations (default 3)
// -k, --key-size int      key size in bytes (default 32)
// -m, --memory int        memory in kibibytes (default 65536)
// -p, --parallelism int   parallelism or threads (default 4)
//     --profile string    profile to use, options are low-memory and recommended
// -s, --salt-size int     salt size in bytes (default 16)
// -v, --variant string    variant, options are 'argon2id', 'argon2i', and 'argon2d' (default "argon2id")

// iterations: 3
// key_length: 32
// salt_length: 16
// memory: 65536
// parallelism: 8
const flags = [
    "--iterations", "3",
    "--key-size", "32",
    "--salt-size", "16",
    "--memory", "65536",
    "--parallelism", "8",
    "--variant", "argon2id",
];

$`docker run authelia/authelia:latest authelia crypto hash generate argon2 ${flags} --password '${password}'`;