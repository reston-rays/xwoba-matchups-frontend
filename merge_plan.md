# Plan: Merge `xwoba-matchups-infra` into `xwoba-matchups-frontend`

**Goal:** Move the Supabase configuration from `xwoba-matchups-infra` into `xwoba-matchups-frontend`, and set up a type-safe workflow for database development.

**Status:** Complete

---

### Phase 1: Investigation and Preparation (Complete)

1.  **Analyze Dependencies:** Examine the `package.json` files in both `xwoba-matchups-infra` and `xwoba-matchups-frontend` to identify any necessary dependencies (like the `supabase` CLI) that need to be merged.
2.  **Review Supabase Config:** Read the `xwoba-matchups-infra/supabase/config.toml` file to understand the current configuration and ensure the project ID is correctly referenced.

---

### Phase 2: Merging the Projects (Complete)

1.  **Move Supabase Directory:** Move the entire `supabase` directory from `xwoba-matchups-infra` into the root of `xwoba-matchups-frontend`.
2.  **Consolidate Dependencies:** Add any development dependencies from the `infra` project to the `package.json` of the `frontend` project.
3.  **Update `.gitignore`:** Ensure the `.gitignore` in `xwoba-matchups-frontend` is updated to exclude Supabase-generated files.

---

### Phase 3: Implementing Schema-to-App Synchronization (Complete)

1.  **Generate TypeScript Types:** Use the command `npx supabase gen types typescript` to connect to the remote Supabase database and generate a TypeScript file defining interfaces for all database entities.
2.  **Create a `package.json` Script:** Add a new script to `xwoba-matchups-frontend/package.json` for repeatable type generation:
    ```json
    "scripts": {
      "sync-types": "npx supabase gen types typescript --project-id <your-project-id> > src/types/supabase.ts"
    }
    ```
3.  **Establish the Workflow:**
    a.  Make schema changes in `supabase/migrations`.
    b.  Apply migrations using `npx supabase db push`.
    c.  Run `npm run sync-types` to update TypeScript definitions.
    d.  Use generated types in the application.

---

### Phase 4: Verification and Cleanup (Complete)

1.  **Run Checks:** Run the linter and any existing tests in `xwoba-matchups-frontend` to verify changes.
2.  **Archive Old Repository:** After confirming everything works, archive or delete the `xwoba-matchups-infra` repository.