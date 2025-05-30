/*
  Forked from https://github.com/vercel/commerce/tree/main/packages/swell/src
  Changes: None
*/
import Cookies, { CookieAttributes } from 'js-cookie'
import { SWELL_COOKIE_EXPIRE, SWELL_CUSTOMER_TOKEN_COOKIE } from '../const'

export const getCustomerToken = () => Cookies.get(SWELL_CUSTOMER_TOKEN_COOKIE)

export const setCustomerToken = (
  token: string | null,
  options?: CookieAttributes
) => {
  if (!token) {
    Cookies.remove(SWELL_CUSTOMER_TOKEN_COOKIE)
  } else {
    console.log(`Setting Swell cookie: name=${SWELL_CUSTOMER_TOKEN_COOKIE}, value=${token}`);
    Cookies.set(
      SWELL_CUSTOMER_TOKEN_COOKIE,
      token,
      options ?? {
        expires: SWELL_COOKIE_EXPIRE,
      }
    )
  }
}
