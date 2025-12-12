# Installation Instructions

There are two main ways of installing, via Docker and running locally. I recommend Docker.

A docker container can store everything, including the test browsers. This way they don't need to be globally installed on your operating system, and it ensures that it works the same on all devices no matter which operating system one is using.

## With Docker
Clone the repository

```(Bash)
git clone https://github.com/Kattenelvis/flowback-interface-testing
cd flowback-interface-testing
```

```(Bash)
docker build .
docker run .
```

## Locally

Install npm packages

```(Bash) 
npm install
```

Install playwright testing browsers (chromium, chromium-headless, firefox, webkit)

```(Bash)
npx playwright install
```

# Running Commands
Then run playwright commands, as found here: https://playwright.dev/docs/test-cli

For instance: 

```(Bash) 
npx playwright test . --headed
```

```(Bash) 
npx playwright test -g "Delegation-Poll" --headed
```

