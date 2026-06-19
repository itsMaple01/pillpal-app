-- One-time manual cleanup: invalid caretaker_patients rows that cause
-- "Medication Taken" pushes to go to unrelated patient accounts.
--
-- Step 1 — inspect rows that would be removed (run this first):
SELECT
  cp.caretaker_uid,
  cp.patient_uid,
  cp.status,
  cu.full_name AS caretaker_name,
  cu.role      AS caretaker_role,
  pu.full_name AS patient_name
FROM caretaker_patients cp
JOIN users cu ON cu.firebase_uid = cp.caretaker_uid
JOIN users pu ON pu.firebase_uid = cp.patient_uid
WHERE cp.caretaker_uid = cp.patient_uid
   OR cu.role NOT IN ('caretaker', 'family')
   OR cu.role IS NULL;

-- Step 2 — delete only after confirming the SELECT results above:
-- DELETE FROM caretaker_patients cp
-- USING users cu
-- WHERE cu.firebase_uid = cp.caretaker_uid
--   AND (
--     cp.caretaker_uid = cp.patient_uid
--     OR cu.role NOT IN ('caretaker', 'family')
--     OR cu.role IS NULL
--   );
