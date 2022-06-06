module.exports = function useThead(arr, max) {
  const work = async () => {
    if (arr.length === 0) return
    const pool = []
    const result = []
    for (let i = 0; i < arr.length; i++) {
      const fn = arr[i]
      const run = Promise.resolve().then(async () => {
        const res = await fn()
        const index = pool.findIndex(item => item === run)
        if (index > -1) {
          pool.splice(index, 1)
        }
        result.push(res)
      })

      pool.push(run)

      if (Object.keys(pool).length === max) {
        await Promise.race(pool)
      }
    }
    while (pool.length) {
      await Promise.race(pool)
    }
    return Promise.resolve(result)
  }

  return {
    work
  }
}
