import { AxiosPromise, AxiosRequestConfig, AxiosResponse } from "../types";
import { parseHeaders } from '../helpers/headers';
import { transformResponse } from '../helpers/data';
import { createError } from "../helpers/error";
import { isURLSameOrigin } from '../helpers/url'
import cookie from '../helpers/cookie'

/**
 * 实际发送请求的方法，使用XMLHttpRequest
 */
export function xhr(config: AxiosRequestConfig): AxiosPromise {
    return new Promise((resolve, reject) => {
        const { url, method = 'GET', data = null, headers, responseType, timeout, cancelToken, withCredentials, xsrfCookieName, xsrfHeaderName } = config;
        const request = new XMLHttpRequest();
        if (responseType) {
            request.responseType = responseType;
        }
        if (timeout) {
            request.timeout = timeout;
        }

        // 允许主动取消请求
        if (cancelToken) {
          cancelToken.promise.then(reason => {
            request.abort();
            reject(reason);
          });
        }
        // 跨域允许携带 Cookie
        if (withCredentials) {
            request.withCredentials = withCredentials;
        }
        /**
         * 若 withCredential 为 true 或为同源请求，对 headers 添加 xsrf 相关的字段
         * 若满足上述条件，从 cookie 中读取 xsrf 的 token 值
         * 若读取到 token ，添加到 headers 的 xsrf 相关字段中
         */
        if ((withCredentials || isURLSameOrigin(url!)) && xsrfCookieName) {
            const xsrfValue = cookie.read(xsrfCookieName);
            if (xsrfValue && xsrfHeaderName) {
                headers[xsrfHeaderName] = xsrfValue;
            }
        }

        request.open(method.toUpperCase(), url!, true);
        request.onreadystatechange = function handleLoad() {
            // 请求未结束，不执行后续逻辑
            if (request.readyState !== 4) {
                return;
            }
            // 请求发生错误直接返回
            if (request.status === 0) {
                return;
            }
            const responseHeaders = parseHeaders(request.getAllResponseHeaders());
            const responseData = responseType && responseType === 'text' ? request.responseText : request.response;
            const response: AxiosResponse = {
                data: responseData,
                status: request.status,
                statusText: request.statusText,
                headers: responseHeaders,
                config,
                request
            }
            handleResponse(response);
        }
        request.onerror = function handleError() {
            reject(createError('Network Error', config, null, request));
        }
        request.ontimeout = function handleTimeout() {
            reject(createError(`Timeout of ${timeout} ms exceeded`, config, 'ECONNABORTED', request))
        }
        Object.keys(headers).forEach((name) => {
            if (data === null && name.toLowerCase() === 'content-type') {
                delete headers[name];
            } else {
                request.setRequestHeader(name, headers[name]);
            }
        })
        request.send(data);

        function handleResponse(response: AxiosResponse): void {
            if (response.status >= 200 && response.status < 300) {
                resolve(response);
            } else {
                reject(createError(`Request failed with status code ${response.status}`, config, null, request, response));
            }
        }
    })
}
