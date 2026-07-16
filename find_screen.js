const fs = require('fs');
const file = '/home/kingusang/.gemini/antigravity-ide/brain/b4e76ad6-1746-4e2b-894c-604a78296666/.system_generated/steps/977/output.txt';
try {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  const screens = data.screens || [];
  screens.forEach(s => {
    if (s.title && s.title.toLowerCase().includes('mock')) {
      console.log(`Title: ${s.title} | ID: ${s.name}`);
    }
  });
} catch (e) { console.error(e.message); }
