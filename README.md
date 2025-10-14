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

Then run playwright commands, as found here: https://playwright.dev/docs/test-cli

For instance: 

```(Bash) 
npx playwright test . --headed
```


```(Bash) 
npx playwright test -g "Delegation-Poll" --headed
```

It might prompt you to install a testing webbrowser. If that happends, do that.
