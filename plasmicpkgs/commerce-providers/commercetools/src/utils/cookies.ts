import Cookies, { CookieAttributes } from 'js-cookie';
import { COMMERCETOOLS_COOKIE_EXPIRE } from '../const'

const options: CookieAttributes = {
  expires: COMMERCETOOLS_COOKIE_EXPIRE,
  sameSite: "none",
  secure: true
}

export const getCookies = <T>(name: string) => {
  const cookie = Cookies.get(name);
  return cookie ? (JSON.parse(cookie) as T) : undefined
}

export const setCookies = (name: string, value: any) => {
  const stringValue = JSON.stringify(value);
  console.log(`Setting commercetools cookie: name=${name}, value=${stringValue}`);
  Cookies.set(name, stringValue, options);
}

export const removeCookies = (name: string) => Cookies.remove(name);
