declare module "deepequal" {
    export default function deepEqual<T>(actual: T, expected: T, strict: boolean): boolean;
}
