-- Migration: helpdesk sequence rename (krok 28).
-- ticket_number_seq -> helpdesk_ticket_number_seq, kvôli konzistencii s Helpdesk*
-- názvoslovím a aby sa nepliedla so vstupenkami (model Ticket / enum TicketStatus).
-- Idempotentné: premenuje len ak starý názov existuje a nový ešte nie.
DO $$ BEGIN
  IF to_regclass('public.ticket_number_seq') IS NOT NULL
     AND to_regclass('public.helpdesk_ticket_number_seq') IS NULL THEN
    ALTER SEQUENCE ticket_number_seq RENAME TO helpdesk_ticket_number_seq;
  END IF;
END $$;

-- Poistka pre čistú DB, kde KROK 27 ešte nebežal.
CREATE SEQUENCE IF NOT EXISTS helpdesk_ticket_number_seq START 1;
