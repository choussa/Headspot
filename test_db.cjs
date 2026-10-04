const fs = require('fs')
const { createClient } = require('@supabase/supabase-js')

const env = fs.readFileSync('.env', 'utf8')
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1]
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1]

const supabase = createClient(url, key)

async function run() {
  console.log('Testing Supabase Connection...')
  
  // Test 1: Can we connect and query projects?
  const { data: projects, error: pErr } = await supabase.from('projects').select('*').limit(1)
  
  // Test 2: Verify RLS (Since we are using ANON_KEY with no session, data should be empty or throw error, NOT leak data)
  if (pErr) {
    console.log('Projects Table RLS/Error:', pErr.message)
  } else {
    console.log('Projects returned (should be 0 due to RLS):', projects.length)
  }

  // Test 3: Check folders schema
  const { data: folders, error: fErr } = await supabase.from('folders').select('*').limit(1)
  if (fErr) {
    console.log('Folders Table RLS/Error:', fErr.message)
  } else {
    console.log('Folders returned:', folders.length)
  }
}
run()
