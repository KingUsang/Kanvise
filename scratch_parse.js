const fs = require('fs');
const path = '/home/kingusang/.gemini/antigravity-ide/brain/b4e76ad6-1746-4e2b-894c-604a78296666/.system_generated/steps/165/output.txt';

try {
  const data = fs.readFileSync(path, 'utf8');
  const json = JSON.parse(data);
  const screens = json.screens || [];
  
  screens.forEach(screen => {
    if (screen.name) {
      console.log(screen.name);
    }
  });
} catch (err) {
  console.error("Error parsing:", err.message);
}
