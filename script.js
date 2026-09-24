const fs = require('fs');
let content = fs.readFileSync('components/AdminDashboard.tsx', 'utf-8');

// Replace 1: Add import
content = content.replace(
  /removeRegistrant,\r?\n} from "@\/app\/admin\/actions";/,
  'removeRegistrant,\n  cleanAllNames,\n} from "@/app/admin/actions";'
);

// Replace 2: Add button
content = content.replace(
  /FAQ &amp; venue\r?\n\s*<\/Button>\r?\n\s*\)\}\r?\n\s*<\/div>/,
  `FAQ &amp; venue
            </Button>
          )}
          {role === "admin" && (
            <Button 
              variant="ghost" 
              onClick={async () => { 
                if(window.confirm('Clean all names in the database? (Strips leading numbers, trailing junk, Title Cases)')) { 
                  const res = await cleanAllNames(); 
                  alert('Updated: ' + res.updated + ' | Errors: ' + res.errors); 
                  window.location.reload(); 
                } 
              }}
            >
              Clean Names
            </Button>
          )}
        </div>`
);

fs.writeFileSync('components/AdminDashboard.tsx', content);
console.log('done modifying AdminDashboard.tsx');
