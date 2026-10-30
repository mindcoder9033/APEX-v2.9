package com.apex.telemetry.core.network

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class CircularRingBufferTest {

    @Test
    fun pushAndRetrieve_withinCapacity() {
        val buffer = CircularRingBuffer<Int>(capacity = 5)
        assertEquals(0, buffer.size)
        assertNull(buffer.latest())
        assertNull(buffer.oldest())

        buffer.push(10)
        buffer.push(20)
        buffer.push(30)

        assertEquals(3, buffer.size)
        assertEquals(30, buffer.latest())
        assertEquals(10, buffer.oldest())
        assertEquals(10, buffer.get(0))
        assertEquals(20, buffer.get(1))
        assertEquals(30, buffer.get(2))
    }

    @Test
    fun push_exceedingCapacity_overwritesOldest() {
        val buffer = CircularRingBuffer<Int>(capacity = 3)

        buffer.push(1)
        buffer.push(2)
        buffer.push(3)
        assertEquals(listOf(1, 2, 3), buffer.toList())

        // Exceed capacity
        buffer.push(4)
        assertEquals(3, buffer.size)
        assertEquals(4L, buffer.totalSamplesReceived)
        assertEquals(4, buffer.latest())
        assertEquals(2, buffer.oldest())
        assertEquals(listOf(2, 3, 4), buffer.toList())

        buffer.push(5)
        assertEquals(listOf(3, 4, 5), buffer.toList())
    }

    @Test
    fun getRecent_returnsCorrectSubset() {
        val buffer = CircularRingBuffer<String>(capacity = 10)
        listOf("A", "B", "C", "D", "E").forEach { buffer.push(it) }

        val recentThree = buffer.getRecent(3)
        assertEquals(listOf("C", "D", "E"), recentThree)

        val recentTen = buffer.getRecent(10)
        assertEquals(listOf("A", "B", "C", "D", "E"), recentTen)
    }

    @Test
    fun clear_resetsBuffer() {
        val buffer = CircularRingBuffer<Int>(capacity = 5)
        buffer.push(1)
        buffer.push(2)

        buffer.clear()
        assertEquals(0, buffer.size)
        assertEquals(0L, buffer.totalSamplesReceived)
        assertNull(buffer.latest())
    }
}

