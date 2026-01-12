/**
 * Result Type - 関数型エラーハンドリング
 *
 * 例外を投げる代わりに、成功/失敗を型で表現する。
 * これにより、エラーハンドリングが型レベルで強制される。
 *
 * @example
 * function divide(a: number, b: number): Result<number, DivisionError> {
 *   if (b === 0) return err({ type: 'DIVISION_BY_ZERO' });
 *   return ok(a / b);
 * }
 *
 * const result = divide(10, 2);
 * if (result.ok) {
 *   console.log(result.value); // 5
 * } else {
 *   console.log(result.error); // エラー情報
 * }
 */

// ============================================
// Result Type Definition
// ============================================

export type Result<T, E> = Ok<T> | Err<E>;

export interface Ok<T> {
  readonly ok: true;
  readonly value: T;
}

export interface Err<E> {
  readonly ok: false;
  readonly error: E;
}

// ============================================
// Constructors
// ============================================

/** 成功結果を作成 */
export const ok = <T>(value: T): Ok<T> => ({ ok: true, value });

/** 失敗結果を作成 */
export const err = <E>(error: E): Err<E> => ({ ok: false, error });

// ============================================
// Type Guards
// ============================================

export const isOk = <T, E>(result: Result<T, E>): result is Ok<T> => result.ok;
export const isErr = <T, E>(result: Result<T, E>): result is Err<E> =>
  !result.ok;

// ============================================
// Combinators
// ============================================

/** 成功時に値を変換 */
export const map = <T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => U
): Result<U, E> => (result.ok ? ok(fn(result.value)) : result);

/** 成功時に別のResultを返す関数を適用 */
export const flatMap = <T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>
): Result<U, E> => (result.ok ? fn(result.value) : result);

/** エラー時にエラーを変換 */
export const mapErr = <T, E, F>(
  result: Result<T, E>,
  fn: (error: E) => F
): Result<T, F> => (result.ok ? result : err(fn(result.error)));

/** 成功値を取得、失敗時はデフォルト値 */
export const unwrapOr = <T, E>(result: Result<T, E>, defaultValue: T): T =>
  result.ok ? result.value : defaultValue;

/** 成功値を取得、失敗時は関数でデフォルト値を計算 */
export const unwrapOrElse = <T, E>(
  result: Result<T, E>,
  fn: (error: E) => T
): T => (result.ok ? result.value : fn(result.error));

/** 複数のResultをすべて成功なら配列で返す */
export const all = <T, E>(results: Result<T, E>[]): Result<T[], E> => {
  const values: T[] = [];
  for (const result of results) {
    if (!result.ok) return result;
    values.push(result.value);
  }
  return ok(values);
};

/** Promise<Result>をResultに変換（非同期関数用） */
export const fromPromise = async <T, E = unknown>(
  promise: Promise<T>,
  errorMapper?: (e: unknown) => E
): Promise<Result<T, E>> => {
  try {
    return ok(await promise);
  } catch (e) {
    return err(errorMapper ? errorMapper(e) : (e as E));
  }
};

/** try-catchをResultに変換 */
export const tryCatch = <T, E = unknown>(
  fn: () => T,
  errorMapper?: (e: unknown) => E
): Result<T, E> => {
  try {
    return ok(fn());
  } catch (e) {
    return err(errorMapper ? errorMapper(e) : (e as E));
  }
};

// ============================================
// Option Type (null/undefined の型安全な扱い)
// ============================================

export type Option<T> = Some<T> | None;

export interface Some<T> {
  readonly _tag: "Some";
  readonly value: T;
}

export interface None {
  readonly _tag: "None";
}

export const some = <T>(value: T): Some<T> => ({ _tag: "Some", value });
export const none: None = { _tag: "None" };

export const isSome = <T>(option: Option<T>): option is Some<T> =>
  option._tag === "Some";
export const isNone = <T>(option: Option<T>): option is None =>
  option._tag === "None";

/** null/undefined を Option に変換 */
export const fromNullable = <T>(value: T | null | undefined): Option<T> =>
  value != null ? some(value) : none;

/** Option を null に変換 */
export const toNullable = <T>(option: Option<T>): T | null =>
  isSome(option) ? option.value : null;

/** Option の値を変換 */
export const mapOption = <T, U>(
  option: Option<T>,
  fn: (value: T) => U
): Option<U> => (isSome(option) ? some(fn(option.value)) : none);

/** Option のデフォルト値 */
export const getOrElse = <T>(option: Option<T>, defaultValue: T): T =>
  isSome(option) ? option.value : defaultValue;
