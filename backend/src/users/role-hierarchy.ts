import { UserRole } from '@prisma/client';

/**
 * User-management krok B – bezpečnostné jadro hierarchie.
 *
 * CREATABLE_BY[actor] = zoznam rolí, ktoré daný actor SMIE vytvárať / priraďovať.
 * Toto je server-side pravda – UI je len kozmetika, autorizácia sa vynucuje tu.
 *
 * Zámerne NIKTO nesmie vytvoriť SUPERADMIN ani STAFF cez tento endpoint,
 * a PLATFORM_ADMIN nesmie vytvoriť ďalšieho PLATFORM_ADMINA ani ACCOUNTANTA.
 * ORGANIZER_MEMBER/SCANNER sa tvoria cez members/scanners moduly (tenant-scoped),
 * preto tu nie sú.
 */
export const CREATABLE_BY: Record<UserRole, UserRole[]> = {
  [UserRole.SUPERADMIN]: [
    UserRole.PLATFORM_ADMIN,
    UserRole.ACCOUNTANT,
    UserRole.ORGANIZER_OWNER,
    UserRole.CUSTOMER,
  ],
  [UserRole.PLATFORM_ADMIN]: [
    UserRole.ORGANIZER_OWNER,
    UserRole.CUSTOMER,
  ],
  [UserRole.STAFF]: [],
  [UserRole.ACCOUNTANT]: [],
  [UserRole.ORGANIZER_OWNER]: [],
  [UserRole.ORGANIZER_MEMBER]: [],
  [UserRole.SCANNER]: [],
  [UserRole.CUSTOMER]: [],
};

/** Smie `actor` vytvoriť / priradiť rolu `target`? */
export function canCreate(actor: UserRole, target: UserRole): boolean {
  return CREATABLE_BY[actor]?.includes(target) ?? false;
}

/**
 * Smie `actor` zasahovať do používateľa, ktorý má MOMENTÁLNE rolu `targetCurrentRole`
 * (zmena role / deaktivácia / reaktivácia)?
 *
 * SUPERADMIN má univerzálny bypass (spravuje kohokoľvek). Ostatní smú siahnuť len
 * na používateľov, ktorých rolu by sami vedeli vytvoriť – tým je PLATFORM_ADMIN
 * zablokovaný od zásahu do SUPERADMINA / iného PLATFORM_ADMINA / ACCOUNTANTA.
 */
export function canManageTarget(actor: UserRole, targetCurrentRole: UserRole): boolean {
  if (actor === UserRole.SUPERADMIN) return true;
  return canCreate(actor, targetCurrentRole);
}
