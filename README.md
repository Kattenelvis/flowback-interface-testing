# Installation Instructions

Clone the repository

```(Bash)
git clone https://github.com/Kattenelvis/flowback-interface-testing
cd flowback-interface-testing
```

Install npm packages

```(Bash) 
npm install
```

Install playwright testing browsers (chromium, chromium-headless, firefox, webkit)

```(Bash)
npx playwright install
```

Then run playwright commands, as found here: https://playwright.dev/docs/test-cli

For instance: 

```(Bash) 
npx playwright test . --headed
```

```(Bash) 
npx playwright test -g "Delegation-Poll" --headed
```


TODO: Make a docker container that can store everything including the test browsers so they don't need to be globally installed on the system and so that it works the same on all devices no matter which operating system one is using.