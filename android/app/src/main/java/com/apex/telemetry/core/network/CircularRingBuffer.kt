package com.apex.telemetry.core.network

/**
 * High-performance, fixed-capacity ring buffer for real-time telemetry streaming.
 * Thread-safe for single-writer, multi-reader concurrent access.
 * Maintains a fixed upper bound of samples to guarantee zero memory leaks over long race sessions.
 */
class CircularRingBuffer<T>(val capacity: Int = 100_000) {

    init {
        require(capacity > 0) { "Capacity must be greater than 0" }
    }

    @Suppress("UNCHECKED_CAST")
    private val buffer: Array<Any?> = arrayOfNulls(capacity)
    
    private var head: Int = 0
    
    @Volatile
    var size: Int = 0
        private set

    @Volatile
    var totalSamplesReceived: Long = 0L
        private set

    /**
     * Appends a new item to the ring buffer. O(1) time complexity.
     * Overwrites the oldest item when buffer capacity is reached.
     */
    @Synchronized
    fun push(item: T) {
        buffer[head] = item
        head = (head + 1) % capacity
        if (size < capacity) {
            size++
        }
        totalSamplesReceived++
    }

    /**
     * Retrieves item at logical index [index], where 0 is the oldest item currently in the buffer
     * and [size] - 1 is the most recent item.
     */
    @Suppress("UNCHECKED_CAST")
    @Synchronized
    fun get(index: Int): T? {
        if (index < 0 || index >= size) return null
        val startIdx = (head - size + capacity) % capacity
        val actualIdx = (startIdx + index) % capacity
        return buffer[actualIdx] as? T
    }

    /**
     * Returns the most recently pushed item, or null if buffer is empty.
     */
    @Suppress("UNCHECKED_CAST")
    @Synchronized
    fun latest(): T? {
        if (size == 0) return null
        val latestIdx = (head - 1 + capacity) % capacity
        return buffer[latestIdx] as? T
    }

    /**
     * Returns the oldest item currently retained in the buffer.
     */
    fun oldest(): T? = get(0)

    /**
     * Returns a list of the latest [count] items in chronological order.
     */
    @Synchronized
    fun getRecent(count: Int): List<T> {
        val n = count.coerceIn(0, size)
        val result = ArrayList<T>(n)
        for (i in 0 until n) {
            get(size - n + i)?.let { result.add(it) }
        }
        return result
    }

    /**
     * Returns all stored items in chronological order.
     */
    @Synchronized
    fun toList(): List<T> {
        val result = ArrayList<T>(size)
        for (i in 0 until size) {
            get(i)?.let { result.add(it) }
        }
        return result
    }

    /**
     * Resets the ring buffer and counters.
     */
    @Synchronized
    fun clear() {
        buffer.fill(null)
        head = 0
        size = 0
        totalSamplesReceived = 0L
    }
}

